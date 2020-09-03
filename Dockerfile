FROM node:10-buster-slim
#  add libraries needed to build
ENV DEBIAN_FRONTEND noninteractive 
RUN apt-get update -qqy

RUN apt-get -qqy --no-install-recommends install \
    ca-certificates \
	fontconfig \
    build-essential \
    python

RUN apt-get -qqy --no-install-recommends install \
    xauth \
    xvfb

# clean apt cache
RUN rm -rf /var/lib/apt/lists/* /var/cache/apt/*


WORKDIR /app
COPY ./package.json /app
COPY ./package-lock.json /app
RUN npm ci
RUN npm i --no-save nyc

COPY . /app
ENTRYPOINT ["xvfb-run"]
CMD ["npx", "nyc", "mocha"]