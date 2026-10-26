# 🌟 StellarAid

Blockchain-powered crowdfunding for global impact — transparent, borderless, and secure.
StellarAid is an open-source, decentralized crowdfunding platform built on the Stellar Network & Soroban smart contracts. It enables creators to raise funds in XLM or any Stellar-based asset, while donors enjoy transparent, verifiable on-chain contributions.
Whether it’s humanitarian campaigns, community causes, startups, or global charity projects — StellarAid brings trust, transparency, and financial accessibility to fundraising.

# 📖 About StellarAid

StellarAid empowers individuals and organizations to launch fundraising campaigns with full blockchain transparency.
The platform supports multi-asset contributions, verifiable donation trails, automated fund releases through Soroban smart contracts, and wallet-based authentication.

- 🔐 Decentralized & Secure — Wallet-based login, non-custodial flows
- 💸 Multi-Asset Support — XLM, USDC, NGNT, custom Stellar assets
- 📊 Transparent — Every donation visible and verifiable on-chain
- ⚙️ Modular & Open Source — Easy for contributors and developers

# 🏗 Organization Repositories

- stellarAid-api → Backend services (NestJS + PostgreSQL )
  - User authentication (wallet + email verification)
  - Campaign approval workflow
  - Donation tracking + analytics
  - Notifications (email/SMS)
  - Admin API endpoints

- the repo includes:

```
/docs        → Technical documentation
/examples    → Sample integrations
/scripts     → Dev and deployment utilities
```

# 🔑 How StellarAid Works

- 1️⃣ User connects Stellar wallet (Freighter, Albedo, Lobstr)
- 2️⃣ Creator launches a campaign → stored in backend + contract ref
- 3️⃣ Donors contribute using Stellar assets
- 4️⃣ Soroban contract escrows funds safely
- 5️⃣ Creators withdraw funds securely on-chain
- 6️⃣ Admin tools handle verification, fraud detection & analytics
  Everything is transparent, globally accessible, and verifiable.

# 🛠 Tech Stack

### ⚙️ Backend Services

- NestJS (modular monolith)
- PostgreSQL (primary data store)
- Redis (cache, rate-limits, nonce store)
- Nodemailer (notifications)

### 🗄 Data Layer

- PostgreSQL for core data
- Redis for caching + session flow
- Optional IPFS for media (campaign images, proofs)

# 🚀 Roadmap

### Phase 1 (MVP)

- User registration + wallet login
- Create & approve campaigns
- Donate using XLM/USDC
- Basic dashboard & on-chain transparency
- Core Soroban contract (escrow + withdraw)

### Phase 2

- Email verification + KYC workflow
- Advanced analytics
- Multi-asset campaign support
- Dispute handling
- Social login (GitHub/Twitter/Discord)

### Phase 3

- Automated payout schedules
- Community governance
- Cross-border NGO support
- Trust badges & identity verification

### Phase 4

- AI-driven fraud scoring
- Multi-chain campaign expansion
- Ecosystem grant program

# 🤝 Contributing

StellarAid is fully open-source and welcomes contributions from:

- Blockchain engineers
- Rust/Soroban developers
- Full-stack devs
- Designers & documentation writers
- Community moderators

See CONTRIBUTING.md for contribution workflow, code style, and development setup.

# 📜 License

StellarAid is released under the MIT License, allowing free use, modification, and distribution with attribution.

# 🌐 Join the StellarAid Journey

Together, we can expand access to transparent, borderless fundraising — empowering communities and creators worldwide.
