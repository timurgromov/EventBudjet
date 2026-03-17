FROM python:3.12-slim

WORKDIR /app

COPY bot /app/bot

EXPOSE 8081

CMD ["python", "-m", "http.server", "8081", "--bind", "0.0.0.0"]
