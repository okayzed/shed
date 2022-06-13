FROM alpine

RUN apk add bash coreutils
RUN apk add python2 python3 nodejs gcc g++ ruby py3-pip
RUN apk add py-future
RUN pip3 install okp

RUN echo http://nl.alpinelinux.org/alpine/edge/testing >> /etc/apk/repositories

RUN apk add mono

COPY runners/* /opt/shed/
