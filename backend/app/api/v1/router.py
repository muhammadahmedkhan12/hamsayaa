from fastapi import APIRouter
from app.api.v1.endpoints import (
    whatsapp,
    residents,
    invoices,
    vehicles,
    complaints,
    polls,
    employees,
    assets,
    amenities,
    test_whatsapp
)

api_router = APIRouter()

api_router.include_router(whatsapp.router, prefix="/whatsapp", tags=["WhatsApp"])
api_router.include_router(test_whatsapp.router, prefix="/whatsapp", tags=["WhatsApp-Test"])
api_router.include_router(residents.router, prefix="/residents", tags=["Residents"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(complaints.router, prefix="/complaints", tags=["Complaints"])

api_router.include_router(vehicles.router, prefix="/vehicles", tags=["Vehicles"])
api_router.include_router(polls.router, prefix="/polls", tags=["Polls"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employees"])
api_router.include_router(assets.router, prefix="/assets", tags=["Assets"])
api_router.include_router(amenities.router, prefix="/amenities", tags=["Amenities"])
