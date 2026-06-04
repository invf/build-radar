"""Celery application configuration with Redis broker."""
from celery import Celery
from celery.schedules import crontab
from ..core.config import settings

celery_app = Celery(
    "buildradar",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
    include=[
        "app.tasks.parser_tasks",
        "app.tasks.ai_tasks",
        "app.tasks.notification_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Kyiv",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=300,
    task_time_limit=600,

    # Parsers are manual-only — no auto-schedule for edesb/prozorro/data_gov.
    # Scheduled tasks (Celery Beat)
    beat_schedule={
        # AI tasks
        "batch-ai-analysis-daily": {
            "task": "app.tasks.ai_tasks.run_batch_ai_analysis",
            "schedule": crontab(hour=2, minute=0),  # 2 AM daily
        },

        # Notification tasks
        "send-saved-search-alerts-hourly": {
            "task": "app.tasks.notification_tasks.check_saved_search_alerts",
            "schedule": crontab(minute=30),  # Every hour at :30
        },
        "send-reminders-daily": {
            "task": "app.tasks.notification_tasks.send_reminder_notifications",
            "schedule": crontab(hour=9, minute=0),  # 9 AM daily
        },
    },
)
