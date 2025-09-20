#!/usr/bin/env bash
# run_local.sh - start backend (UNIX)
# Usage: ./run_local.sh

export $(grep -v '^#' .env | xargs) 2>/dev/null || true
uvicorn main:app --host 0.0.0.0 --port ${BACKEND_PORT:-8000} --reload
