FROM node:8
RUN mkdir /app
COPY *.js /app/
COPY *.json /app/
workdir /app
RUN npm install
CMD ["npm", "start"]