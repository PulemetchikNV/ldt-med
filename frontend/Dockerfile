FROM node:20-alpine AS build
WORKDIR /app

# Build args
ARG VITE_API_URL

# Make them visible to Vite at build time
ENV VITE_API_URL=$VITE_API_URL \

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]