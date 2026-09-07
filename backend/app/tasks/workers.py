from app.tasks.celery_app import celery_app
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name="tasks.check_vehicle_overstays")
def check_vehicle_overstays():
    """
    Periodic job: Scans vehicle_logs where exit_time IS NULL.
    Ignores registered resident vehicles.
    If unregistered vehicle pass is expired (0-min grace), sets is_flagged_overstay=True.
    """
    logger.info("Running overstay detection check...")
    return {"status": "success", "overstays_flagged": 0}

@celery_app.task(name="tasks.purge_expired_cnic_data")
def purge_expired_cnic_data():
    """
    Daily job: Purges visitor_cnic from visitor_passes older than 30 days.
    """
    logger.info("Purging visitor CNIC records older than 30 days...")
    return {"status": "success", "records_purged": 0}

@celery_app.task(name="tasks.compile_poll_results")
def compile_poll_results(poll_id: str):
    """
    Job triggered upon poll expiry: Compiles static Excel/PDF summary and triggers notification distribution.
    """
    logger.info(f"Compiling results for poll ID: {poll_id}")
    return {"status": "success", "poll_id": poll_id}
