FROM python:3.12-slim
WORKDIR /app
COPY server.py index.html styles.css app.mjs game.mjs /app/
USER 65532:65532
EXPOSE 8080
CMD ["python", "-B", "-u", "/app/server.py"]
