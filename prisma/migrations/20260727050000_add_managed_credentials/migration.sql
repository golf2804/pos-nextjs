CREATE TABLE "managed_credentials" (
    "user_id" UUID NOT NULL,
    "encrypted_password" TEXT NOT NULL,
    "initialization_vector" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "managed_credentials_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "managed_credentials"
ADD CONSTRAINT "managed_credentials_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
