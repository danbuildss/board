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
            GENESIS BOARD — HOOD
          </h2>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.75, marginBottom: 12 }}>
            The first Board is HOOD, deployed on Robinhood Chain Testnet (Chain 46630).
            It proves the core mechanics: take, hold, reprice, top-up, takeover, grace,
            and foreclosure — with exact financial reconciliation at every step.
          </p>
          <p style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.75 }}>
            This is a testnet deployment. No real funds are at risk. The mechanism is
            being proven before mainnet launch.
          </p>
        </div>

        <div style={{ borderTop: '1px solid var(--bd0)', paddingTop: 32 }}>
          <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
            CONTRACTS · HOOD CHAIN TESTNET (46630)
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
