#!/bin/bash
cd "$(dirname $0)/server"
NODE_ENV=production node dist/index.js
