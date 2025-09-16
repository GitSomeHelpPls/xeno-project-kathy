from datetime import datetime, timedelta
import jwt  # PyJWT library

# Secret key (should match your backend JWT_SECRET)
secret_key = "your_super_secret_jwt_key_here_make_it_long_and_secure_2024"
algorithm = "HS256"

# Admin user payload data
user_data = {
    "user_id": "admin",
    "username": "admin@xeno.com",
    "email": "admin@xeno.com",
    "role": "admin"
}

# Add expiration time (1 year from now for admin token)
expiration_time = datetime.utcnow() + timedelta(days=365)
issued_at = datetime.utcnow()

payload = {
    "sub": user_data["user_id"],
    "email": user_data["email"],
    "username": user_data["username"],
    "role": user_data["role"],
    "exp": int(expiration_time.timestamp()),
    "iat": int(issued_at.timestamp())
}

# Generate the JWT
token = jwt.encode(payload, secret_key, algorithm=algorithm)

print("="*60)
print("🔐 FRESH JWT TOKEN GENERATED")
print("="*60)
print(f"Token: {token}")
print("")
print("📅 Token Details:")
print(f"• Issued At: {issued_at}")
print(f"• Expires At: {expiration_time}")
print(f"• Valid For: 365 days")
print(f"• User: {user_data['email']}")
print(f"• Role: {user_data['role']}")
print("")
print("🚨 IMPORTANT:")
print("1. Use this as your ADMIN_JWT_TOKEN in Railway environment variables")
print("2. Make sure JWT_SECRET matches the secret_key used here")
print("3. Remove the old expired ADMIN_JWT_TOKEN from Railway")
print("="*60)