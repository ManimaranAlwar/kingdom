"""
Vercel entrypoint.

Vercel's Python runtime will treat this as a Serverless Function.
We re-export the Flask `app` defined in the repo root.
"""

from app import app  # noqa: F401

