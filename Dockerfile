# Use the official Python image as base
FROM python:3.11

LABEL authors="thamindu_g"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set the working directory in the container
WORKDIR /app

# Copy only the requirements file to the working directory
COPY requirements.txt .

# Install pkg-config
RUN apt-get update && apt-get install -y pkg-config libhdf5-dev

# Install any dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Expose port 5005 to the outside world (if needed)
EXPOSE 5005

# Set the entry point of the container
ENTRYPOINT ["python", "Flask_App.py"]

