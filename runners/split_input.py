#!/usr/bin/env python2

import os
import sys

data = sys.stdin.read()
tokens = data.split("")

with open("./code", "w") as f:
    f.write(tokens[0].strip())

with open("./stdin", "w") as f:
    f.write(tokens[1].strip())


