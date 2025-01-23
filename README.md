# EARTHZETA: Advanced Social Blockchain Intelligence System

## Overview
EARTHZETA is an advanced artificial intelligence system built on the Solana blockchain, integrating sophisticated machine learning capabilities with social media interaction and decentralized trading functionality. The system represents a significant advancement in blockchain-based AI agents, offering autonomous operation while maintaining high standards of reliability and security.

The platform's native token, `$EARTHZETA`, facilitates governance and access to premium features through the PumpFun decentralized exchange.

## Core Capabilities

### Autonomous Intelligence
- Advanced natural language processing
- Dynamic behavioral adaptation
- Real-time market analysis
- Automated decision-making systems
- Community-driven development framework

## System Architecture

### AI Infrastructure
- **Multi-Model Architecture**
  - Primary Engine: DeepSeek (33B parameters)
  - Secondary Systems: Groq, OpenAI GPT-4, Claude-3, Ollama
  - Redundant failover systems
  - Optimized prompt engineering

### Trading Infrastructure
- Real-time market analysis engine
- Jupiter DEX integration
- Advanced slippage protection
- Portfolio optimization algorithms
- Social sentiment analysis integration

### Data Architecture
- PostgreSQL: Primary structured data storage
- MongoDB: Unstructured data management
- Redis: High-performance caching
- Distributed transaction management

### Monitoring Systems
- Birdeye & Helius market data integration
- Social media analytics
- Comprehensive logging infrastructure
- Real-time performance metrics

## Key Features

### Social Intelligence Systems
- Real-time social media engagement
- AI-powered content generation
- Natural language processing
- Advanced sentiment analysis
- Behavioral adaptation algorithms

### Trading Functionality
- DEX integration (Jupiter Protocol)
- Market analysis systems
- AI-driven strategy execution
- Risk management protocols
- Portfolio optimization

### AI Integration
- Primary: Groq infrastructure
- Custom prompt engineering
- Advanced contextual processing

### Blockchain Integration
- Native Solana compatibility
- Multi-wallet architecture
- Market data integration (Helius & Birdeye)
- On-chain analytics

## Token Economics
The `$EARTHZETA` token provides:

- Governance participation rights
- Premium feature access
- Community membership benefits
- Trading fee optimizations

## Interface Options
System interaction available through:

- Twitter interface (@earthzeta)
- Direct communication protocol
- Trading command system
- Governance platform

Supported operations include:

- Market analysis
- Trading insights generation
- Interactive communication
- Market status updates
- Content generation
- Community feedback processing

## Technical Requirements

### Hardware Specifications
- CPU: 4+ cores
- RAM: 16GB minimum
- Storage: 100GB SSD
- Network: 100Mbps dedicated connection

### Software Dependencies
- Node.js ≥18.0.0
- pnpm ≥8.0.0
- PostgreSQL ≥14.0
- MongoDB ≥6.0
- Redis ≥7.0
- Solana CLI tools

### Database Configuration
1. **PostgreSQL Implementation**
   ```bash
   # PostgreSQL installation
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   
   # Service initialization
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   
   # Database configuration
   sudo -u postgres psql
   CREATE DATABASE meme_agent_db;
   CREATE USER meme_agent_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE meme_agent_db TO meme_agent_user;
   ```

2. **Redis Implementation**
   ```bash
   # Redis installation
   sudo apt update
   sudo apt install redis-server
   
   # Service configuration
   sudo systemctl start redis-server
   sudo systemctl enable redis-server
   
   # Connection verification
   redis-cli ping
   ```

## Deployment Guide

**Note:** Utilize `pnpm` for package management consistency.

1. **Repository Setup**
   ```bash
   git clone https://github.com/earthzeta/meme-ai-agent.git
   cd meme-ai-agent
   ```

2. **Dependency Installation**
   ```bash
   # Install required packages
   pnpm install
   ```

3. **Database Verification**
   ```bash
   # Redis connectivity test
   redis-cli ping

   # PostgreSQL connectivity test
   psql -h 127.0.0.1 -U meme_agent_user -d meme_agent_db -c '\conninfo'
   ```

4. **Environment Configuration**
   ```bash
   # Environment setup
   cp .env.example .env
   ```

   Required configuration parameters:
   ```env
   # Redis Configuration
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your_password

   # PostgreSQL Configuration
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_USER=meme_agent_user
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=meme_agent_db
   ```

5. **System Initialization**
   ```bash
   # Build process
   pnpm build

   # Standard initialization
   pnpm start

   # Character-specific initialization
   pnpm start --character=characters/earthzeta.character.json
   ```

## Technical Architecture

### AI Processing Pipeline
- Task-specific model selection
- Parallel processing implementation
- Automated failover systems
- Response validation protocols

### Database Architecture
- Polyglot persistence implementation
- Distributed transaction management
- Automated data lifecycle management
- Cache invalidation protocols

### Trading Infrastructure
- Multi-DEX routing system
- Dynamic slippage management
- Risk assessment protocols
- Performance monitoring
- Position management automation

## Advanced Configuration

### AI Model Parameters
