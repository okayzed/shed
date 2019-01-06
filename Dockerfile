FROM alpine

RUN apk add bash coreutils
RUN apk add python2 python3 nodejs gcc g++ ruby 

COPY runners/* /opt/shed/
