export default function AboutPage() {
  return (
    <div className="page-scroll">
      <div className="page-inner" style={{ maxWidth: 680, padding: '48px 40px' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>
            ABOUT
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-.02em', color: 'var(--t1)', marginBottom: 12 }}>
            BOARD
          </h1>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.7 }}>
            A contestable ownership game built around productive on-chain market positions.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--bd0)', paddingTop: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
            THE MECHANISM
          </h2>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.75, marginBottom: 12 }}>
            Every Board has 100 Seats. Each Seat has a self-assessed price. You pay a
            weekly holding cost proportional to your asking price — you set the price,
            you set the cost. Anyone can take your Seat by paying your asking price.
            You receive 95% of the sale instantly.
          </p>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.75 }}>
            If your holding balance runs out, your Seat enters grace. After 72 hours
            in grace, anyone can foreclose and the Seat returns to vacant.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--bd0)', paddingTop: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
            ECONOMICS
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Vacant Seat Price', '$10'],
              ['Holding Rate', '0.5% per week'],
              ['Seller Share', '95% of takeover price'],
              ['Protocol Fee', '5% of takeover price'],
              ['Grace Period', '72 hours'],
              ['Min Coverage', '2 weeks on take'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bd0)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                <span style={{ color: 'var(--t3)' }}>{label}</span>
                <span style={{ color: 'var(--t1)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--bd0)', paddingTop: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
            BOARD #001 / GENESIS
          </h2>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.75, marginBottom: 12 }}>
            The first Board is BOARD #001 / GENESIS, deployed on Robinhood Chain Testnet (Chain 46630).
            It proves the core mechanics: take, hold, reprice, top-up, takeover, grace,
            and foreclosure — with exact financial reconciliation at every step.
          </p>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.75 }}>
            This is a testnet deployment. No real funds are at risk. The mechanism is
            being proven before mainnet launch.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--bd0)', paddingTop: 32, marginBottom: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
            COMMUNITY
          </h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <a
              href="https://x.com/playboard_xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.632zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Twitter / X
            </a>
            <a
              href="https://discord.gg/playboard"
              target="_blank"
              rel="noopener noreferrer"
              className="social-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              Discord
            </a>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--bd0)', paddingTop: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
            CONTRACTS · ROBINHOOD CHAIN TESTNET (46630)
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['BOARD', '0x6A57Ff5C1d105941c8A6CcCC681F37B1FED9733E'],
              ['REWARD ACCOUNTING', '0xf51FAACD5a76Bf315a9473FcE549a49B2fe3cb78'],
              ['BOARD VAULT', '0xf3751c59f4D90B3F117560Fc61c7968D8e1C4648'],
              ['REGISTRY', '0x65fae2658BB7391E57290cb055E1448E3aa76cF6'],
              ['SETTLEMENT (USDG)', '0x7E955252E15c84f5768B83c41a71F9eba181802F'],
            ].map(([label, addr]) => (
              <div key={label} style={{ padding: '8px 12px', background: 'var(--bg2)', border: '1px solid var(--bd0)', borderRadius: 'var(--r-xs)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.12em', color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t2)', wordBreak: 'break-all' }}>{addr}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
