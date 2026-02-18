#!/bin/bash
cd /home/kavia/workspace/code-generation/production-log-dashboard-323359/production_log_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

