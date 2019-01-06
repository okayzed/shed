#!/usr/bin/env bash
source /opt/shed/shared.sh

/usr/bin/g++ -x c++ ${FCODE} -o /tmp/a.out && run /tmp/a.out
