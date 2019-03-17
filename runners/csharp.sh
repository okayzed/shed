#!/usr/bin/env bash
source /opt/shed/shared.sh

cat ${FCODE} > /tmp/code.cs
csharp /tmp/code.cs
