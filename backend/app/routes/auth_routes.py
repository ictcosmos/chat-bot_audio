from fastapi import APIRouter, HTTPException, Depends, Header

from app.services.firebase_service import verify_token, get_user, create_user

router = APIRouter()


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ")[1]
    try:
        return verify_token(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@router.post("/verify")
async def verify(user: dict = Depends(get_current_user)):
    uid = user["uid"]
    existing = get_user(uid)
    if not existing:
        create_user(uid, {
            "name": user.get("name", ""),
            "email": user.get("email", ""),
            "created_at": None,
            "last_login": None,
        })
    return {
        "uid": uid,
        "email": user.get("email", ""),
        "name": user.get("name", ""),
    }


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    existing = get_user(user["uid"])
    return {
        "uid": user["uid"],
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "profile": existing or {},
    }
