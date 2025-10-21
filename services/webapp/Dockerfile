FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

# 🔽 important : passer les args au build Vite
ARG VITE_SEARCH_URL
ARG VITE_BOOKING_URL
ARG VITE_RIDE_URL
ENV VITE_SEARCH_URL=$VITE_SEARCH_URL \
    VITE_BOOKING_URL=$VITE_BOOKING_URL \
    VITE_RIDE_URL=$VITE_RIDE_URL

RUN npm run build

FROM nginx:alpine
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
