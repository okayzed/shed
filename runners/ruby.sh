#!/usr/bin/env bash
source /opt/shed/shared.sh

run /usr/bin/ruby ${FCODE} < ${FSTDIN}
