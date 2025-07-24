from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr
import os
import logging
import uuid
import json
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-here-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="Messenger API")
api_router = APIRouter(prefix="/api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_connections: Dict[str, List[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, connection_id: str):
        await websocket.accept()
        self.active_connections[connection_id] = websocket
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(connection_id)

    def disconnect(self, connection_id: str, user_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if user_id in self.user_connections:
            if connection_id in self.user_connections[user_id]:
                self.user_connections[user_id].remove(connection_id)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def send_personal_message(self, message: str, connection_id: str):
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            await websocket.send_text(message)

    async def send_to_user(self, message: dict, user_id: str):
        if user_id in self.user_connections:
            message_str = json.dumps(message)
            for connection_id in self.user_connections[user_id]:
                await self.send_personal_message(message_str, connection_id)

    async def send_to_group(self, message: dict, user_ids: List[str]):
        message_str = json.dumps(message)
        for user_id in user_ids:
            await self.send_to_user(message, user_id)

manager = ConnectionManager()

# Pydantic Models
class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=6)
    display_name: str = Field(max_length=100)

class UserLogin(BaseModel):
    username: str
    password: str

class UserProfile(BaseModel):
    id: str
    username: str
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    is_online: bool = False
    last_seen: Optional[datetime] = None
    created_at: datetime

class UserSettings(BaseModel):
    display_name: str = Field(max_length=100)
    avatar_url: Optional[str] = None
    theme: str = Field(default="light")
    notifications_enabled: bool = Field(default=True)

class MessageCreate(BaseModel):
    content: str = Field(max_length=1000)
    conversation_id: str

class Message(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_avatar: Optional[str] = None
    content: str
    conversation_id: str
    timestamp: datetime
    message_type: str = "text"

class ConversationCreate(BaseModel):
    participant_ids: List[str]
    is_group: bool = False
    group_name: Optional[str] = None

class Conversation(BaseModel):
    id: str
    participants: List[UserProfile]
    is_group: bool
    group_name: Optional[str] = None
    last_message: Optional[Message] = None
    created_at: datetime
    updated_at: datetime

class GroupCreate(BaseModel):
    name: str = Field(max_length=100)
    description: Optional[str] = Field(max_length=500)
    participant_ids: List[str]

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
    return UserProfile(**user)

# Authentication routes
@api_router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({
        "$or": [{"username": user_data.username}, {"email": user_data.email}]
    })
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username or email already registered"
        )
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user_dict = {
        "id": str(uuid.uuid4()),
        "username": user_data.username,
        "email": user_data.email,
        "display_name": user_data.display_name,
        "password_hash": hashed_password,
        "avatar_url": None,
        "is_online": False,
        "last_seen": datetime.utcnow(),
        "created_at": datetime.utcnow(),
        "theme": "light",
        "notifications_enabled": True
    }
    
    await db.users.insert_one(user_dict)
    user_dict.pop("password_hash")
    user_profile = UserProfile(**user_dict)
    
    # Create token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data.username}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, user=user_profile)

@api_router.post("/login", response_model=Token)
async def login(user_data: UserLogin):
    user = await db.users.find_one({"username": user_data.username})
    if not user or not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update online status
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"is_online": True, "last_seen": datetime.utcnow()}}
    )
    
    user.pop("password_hash")
    user_profile = UserProfile(**user)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user_data.username}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, user=user_profile)

@api_router.post("/logout")
async def logout(current_user: UserProfile = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": {"is_online": False, "last_seen": datetime.utcnow()}}
    )
    return {"message": "Successfully logged out"}

# User routes
@api_router.get("/me", response_model=UserProfile)
async def get_current_user_profile(current_user: UserProfile = Depends(get_current_user)):
    return current_user

@api_router.put("/me", response_model=UserProfile)
async def update_profile(
    settings: UserSettings,
    current_user: UserProfile = Depends(get_current_user)
):
    update_data = {
        "display_name": settings.display_name,
        "theme": settings.theme,
        "notifications_enabled": settings.notifications_enabled
    }
    if settings.avatar_url:
        update_data["avatar_url"] = settings.avatar_url
    
    await db.users.update_one(
        {"id": current_user.id},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"id": current_user.id})
    updated_user.pop("password_hash")
    return UserProfile(**updated_user)

@api_router.get("/users", response_model=List[UserProfile])
async def get_users(current_user: UserProfile = Depends(get_current_user)):
    users = await db.users.find(
        {"id": {"$ne": current_user.id}},
        {"password_hash": 0}
    ).to_list(100)
    return [UserProfile(**user) for user in users]

@api_router.get("/users/search")
async def search_users(
    query: str,
    current_user: UserProfile = Depends(get_current_user)
):
    users = await db.users.find(
        {
            "$and": [
                {"id": {"$ne": current_user.id}},
                {
                    "$or": [
                        {"username": {"$regex": query, "$options": "i"}},
                        {"display_name": {"$regex": query, "$options": "i"}}
                    ]
                }
            ]
        },
        {"password_hash": 0}
    ).to_list(50)
    return [UserProfile(**user) for user in users]

# Message routes
@api_router.post("/messages", response_model=Message)
async def send_message(
    message_data: MessageCreate,
    current_user: UserProfile = Depends(get_current_user)
):
    # Check if conversation exists and user is participant
    conversation = await db.conversations.find_one({"id": message_data.conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    participant_ids = [p["id"] for p in conversation["participants"]]
    if current_user.id not in participant_ids:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    # Create message
    message_dict = {
        "id": str(uuid.uuid4()),
        "sender_id": current_user.id,
        "sender_name": current_user.display_name,
        "sender_avatar": current_user.avatar_url,
        "content": message_data.content,
        "conversation_id": message_data.conversation_id,
        "timestamp": datetime.utcnow(),
        "message_type": "text"
    }
    
    await db.messages.insert_one(message_dict)
    
    # Update conversation last message
    await db.conversations.update_one(
        {"id": message_data.conversation_id},
        {"$set": {"updated_at": datetime.utcnow()}}
    )
    
    message = Message(**message_dict)
    
    # Send to all participants via WebSocket
    await manager.send_to_group({
        "type": "new_message",
        "message": message_dict
    }, participant_ids)
    
    return message

@api_router.get("/conversations/{conversation_id}/messages", response_model=List[Message])
async def get_messages(
    conversation_id: str,
    limit: int = 50,
    current_user: UserProfile = Depends(get_current_user)
):
    # Check if user is participant
    conversation = await db.conversations.find_one({"id": conversation_id})
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    participant_ids = [p["id"] for p in conversation["participants"]]
    if current_user.id not in participant_ids:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")
    
    messages = await db.messages.find(
        {"conversation_id": conversation_id}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    messages.reverse()  # Return in chronological order
    return [Message(**msg) for msg in messages]

# Conversation routes
@api_router.post("/conversations", response_model=Conversation)
async def create_conversation(
    conv_data: ConversationCreate,
    current_user: UserProfile = Depends(get_current_user)
):
    # Add current user to participants if not already included
    participant_ids = list(set(conv_data.participant_ids + [current_user.id]))
    
    # For direct messages, check if conversation already exists
    if not conv_data.is_group and len(participant_ids) == 2:
        existing_conv = await db.conversations.find_one({
            "is_group": False,
            "participants.id": {"$all": participant_ids}
        })
        if existing_conv:
            return Conversation(**existing_conv)
    
    # Get participant profiles
    participants = await db.users.find(
        {"id": {"$in": participant_ids}},
        {"password_hash": 0}
    ).to_list(100)
    
    conversation_dict = {
        "id": str(uuid.uuid4()),
        "participants": participants,
        "is_group": conv_data.is_group,
        "group_name": conv_data.group_name,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.conversations.insert_one(conversation_dict)
    
    return Conversation(**conversation_dict)

@api_router.get("/conversations", response_model=List[Conversation])
async def get_conversations(current_user: UserProfile = Depends(get_current_user)):
    conversations = await db.conversations.find(
        {"participants.id": current_user.id}
    ).sort("updated_at", -1).to_list(100)
    
    # Get last message for each conversation
    for conv in conversations:
        last_message = await db.messages.find_one(
            {"conversation_id": conv["id"]},
            sort=[("timestamp", -1)]
        )
        if last_message:
            conv["last_message"] = last_message
    
    return [Conversation(**conv) for conv in conversations]

# Group routes
@api_router.post("/groups", response_model=Conversation)
async def create_group(
    group_data: GroupCreate,
    current_user: UserProfile = Depends(get_current_user)
):
    conv_data = ConversationCreate(
        participant_ids=group_data.participant_ids + [current_user.id],
        is_group=True,
        group_name=group_data.name
    )
    return await create_conversation(conv_data, current_user)

@api_router.put("/groups/{group_id}/participants")
async def add_participants(
    group_id: str,
    participant_ids: List[str],
    current_user: UserProfile = Depends(get_current_user)
):
    conversation = await db.conversations.find_one({"id": group_id, "is_group": True})
    if not conversation:
        raise HTTPException(status_code=404, detail="Group not found")
    
    current_participant_ids = [p["id"] for p in conversation["participants"]]
    if current_user.id not in current_participant_ids:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # Get new participants
    new_participants = await db.users.find(
        {"id": {"$in": participant_ids}},
        {"password_hash": 0}
    ).to_list(100)
    
    # Update conversation
    all_participants = conversation["participants"] + new_participants
    await db.conversations.update_one(
        {"id": group_id},
        {"$set": {"participants": all_participants, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Participants added successfully"}

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    connection_id = str(uuid.uuid4())
    await manager.connect(websocket, user_id, connection_id)
    
    # Update user online status
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_online": True, "last_seen": datetime.utcnow()}}
    )
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages if needed
            pass
    except WebSocketDisconnect:
        manager.disconnect(connection_id, user_id)
        # Update user offline status
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"is_online": False, "last_seen": datetime.utcnow()}}
        )

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include the router in the main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)