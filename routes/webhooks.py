from fastapi import APIRouter

routeur = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@routeur.get("/health")
def health():
    return {"status": "ok"}
