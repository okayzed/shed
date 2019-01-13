#!/usr/bin/env bash
source /opt/shed/shared.sh

cat ${FCODE} > /tmp/code.cpy
okp /tmp/code.cpy -- -O3
run ./a.out
