FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-timeout 120000 \
    && npm install
COPY . .

# Important: pass args to Vite build
ARG VITE_SEARCH_URL
ARG VITE_BOOKING_URL
ARG VITE_RIDE_URL
ARG VITE_PAYMENT_URL
ARG VITE_IDENTITY_URL
ARG VITE_MESSAGING_URL
ENV VITE_SEARCH_URL=$VITE_SEARCH_URL \
    VITE_BOOKING_URL=$VITE_BOOKING_URL \
    VITE_RIDE_URL=$VITE_RIDE_URL \
    VITE_PAYMENT_URL=$VITE_PAYMENT_URL \
    VITE_IDENTITY_URL=$VITE_IDENTITY_URL \
    VITE_MESSAGING_URL=$VITE_MESSAGING_URL

RUN npm run build

FROM nginx:alpine
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
