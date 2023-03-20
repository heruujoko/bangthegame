FROM node:14
COPY . .
RUN yarn
RUN yarn add bcrypt
EXPOSE 3000
CMD ["yarn", "start"]