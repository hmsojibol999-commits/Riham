FROM python:3.12-slim
WORKDIR /app
COPY requirements-production.txt requirements.txt ./
RUN pip install --no-cache-dir -r requirements-production.txt
COPY . .
RUN useradd --create-home appuser && mkdir -p /app/uploads && chown -R appuser /app
USER appuser
ENV PYTHONUNBUFFERED=1
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8000')+'/api/health',timeout=3)" || exit 1
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
