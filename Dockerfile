FROM node:13.8-alpine

# Verification API port
EXPOSE 3000

ENV CHROME_BIN="/usr/bin/chromium-browser"
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD="true"

RUN set -x \
    && apk update \
    && apk upgrade \
    && apk add --no-cache \
    udev \
    ttf-freefont \
    chromium

WORKDIR /srv/app

COPY . /srv/app

RUN npm install

CMD npm start 