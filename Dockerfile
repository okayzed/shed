FROM alpine

RUN apk add bash coreutils
RUN apk add python2 python3 nodejs gcc g++ ruby 
RUN apk add py-future
RUN pip3 install okp

COPY runners/* /opt/shed/
