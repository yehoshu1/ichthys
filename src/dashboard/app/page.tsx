"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Image from "next/image";

export default function Home() {
    const { data: session } = useSession();

    return (
        <main style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            textAlign: 'center',
            padding: '20px'
        }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '10px' }}>ΙΧΘΥΣ</h1>
            <p style={{ fontSize: '1.2rem', color: '#B9BBBE', marginBottom: '30px' }}>
                A powerful and scalable Discord bot for your community.
            </p>

            {!session ? (
                <button
                    onClick={() => signIn("discord")}
                    style={{
                        backgroundColor: '#5865F2',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#4752C4')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#5865F2')}
                >
                    Login with Discord
                </button>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {session.user?.image && (
                            <Image
                                src={session.user.image}
                                alt="Avatar"
                                width={50}
                                height={50}
                                style={{ borderRadius: '50%' }}
                            />
                        )}
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>{session.user?.name}</p>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#B9BBBE' }}>Logged in</p>
                        </div>
                    </div>

                    <a
                        href="/guilds"
                        style={{
                            backgroundColor: '#5865F2',
                            color: 'white',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            fontSize: '1rem',
                            fontWeight: 'bold',
                        }}
                    >
                        Go to Dashboard
                    </a>

                    <button
                        onClick={() => signOut()}
                        style={{
                            backgroundColor: 'transparent',
                            color: '#ED4245',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #ED4245',
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}
                    >
                        Logout
                    </button>
                </div>
            )}
        </main>
    );
}
