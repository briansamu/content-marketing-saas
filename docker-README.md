# Docker Setup for Content Marketing SaaS

This project uses Docker Compose to set up a development environment with the following services:
- Client (React application)
- Server (Node.js/Express application)
- PostgreSQL database
- Redis for caching and session management

## Prerequisites

- Docker Engine
- Docker Compose

## Getting Started

1. Clone the repository:
```bash
git clone <repository-url>
cd content-marketing-saas
```

2. Start the services:
```bash
docker-compose up
```

This will start all services defined in the `docker-compose.yml` file:
- Client app: http://localhost:3000
- Server API: http://localhost:5000
- PostgreSQL: localhost:5432 (credentials in docker-compose.yml)
- Redis: localhost:6379

3. To run in detached mode:
```bash
docker-compose up -d
```

4. To stop all services:
```bash
docker-compose down
```

5. To rebuild the services after making changes to Dockerfiles:
```bash
docker-compose build
docker-compose up
```

## Data Persistence

Database data is stored in Docker volumes:
- `postgres_data`: PostgreSQL data
- `redis_data`: Redis data

These volumes persist even when containers are stopped or removed.

## Environment Variables

The Docker Compose setup uses environment variables defined in the `docker-compose.yml` file. You can customize them as needed.

## Accessing the Database

Connect to PostgreSQL using any DB client with these credentials:
- Host: localhost
- Port: 5432
- Username: postgres
- Password: postgres
- Database: content_marketing 