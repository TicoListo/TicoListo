"use client";

import { useEffect, useState } from "react";
import { getCurrentUser, getMyAssistanceRequests, loginAccount, logoutAccount, registerAccount } from "../lib/api";

export default function AccountPage() {
  const [language, setLanguage] = useState("es");
  const [mode, setMode] = useState("login");
  const [user, setUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ full_name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const es = language === "es";

  useEffect(() => {
    getCurrentUser()
      .then((currentUser) => {
        setUser(currentUser);
        return getMyAssistanceRequests();
      })
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const currentUser = mode === "login"
        ? await loginAccount({ email: form.email, password: form.password })
        : await registerAccount(form);
      setUser(currentUser);
      setRequests(await getMyAssistanceRequests());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await logoutAccount();
    setUser(null);
    setRequests([]);
  }

  return (
    <main className="page-shell account-page">
      <div className="admin-heading">
        <div><p className="eyebrow">TicoListo</p><h1>{es ? "Mi cuenta" : "My account"}</h1><p>{es ? "Crea una cuenta para enviar solicitudes y dar seguimiento a tus trámites." : "Create an account to submit requests and track your procedures."}</p></div>
        <div className="admin-heading-actions"><button type="button" className="admin-theme-toggle" onClick={() => setLanguage(es ? "en" : "es")}>{es ? "English" : "Español"}</button><a className="admin-back" href="/">{es ? "← Ver sitio público" : "← Public site"}</a></div>
      </div>
      {loading && !user ? <p>{es ? "Cargando..." : "Loading..."}</p> : user ? (
        <section className="account-card">
          <p className="eyebrow">{es ? "Sesión activa" : "Signed in"}</p>
          <h2>{user.full_name}</h2><p>{user.email}</p>
          <h3>{es ? "Mis solicitudes" : "My requests"}</h3>
          {requests.length ? <div className="account-request-list">{requests.map((item) => <article key={item.id}><strong>#{item.id} · {item.category}</strong><span>{item.status}</span><p>{item.description}</p></article>)}</div> : <p>{es ? "Aún no tienes solicitudes asociadas a tu cuenta." : "You do not have requests linked to your account yet."}</p>}
          <button className="secondary" type="button" onClick={logout}>{es ? "Cerrar sesión" : "Sign out"}</button>
        </section>
      ) : (
        <section className="account-card">
          <div className="account-tabs"><button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>{es ? "Iniciar sesión" : "Sign in"}</button><button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>{es ? "Crear cuenta" : "Create account"}</button></div>
          <form onSubmit={submit} className="account-form">
            {mode === "register" && <><label>{es ? "Nombre completo" : "Full name"}<input required minLength="2" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label><label>{es ? "Teléfono (opcional)" : "Phone (optional)"}<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label></>}
            <label>{es ? "Correo electrónico" : "Email"}<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
            <label>{es ? "Contraseña" : "Password"}<input required minLength={mode === "register" ? 10 : 1} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            <button className="primary" disabled={loading} type="submit">{loading ? (es ? "Procesando..." : "Processing...") : mode === "login" ? (es ? "Entrar" : "Sign in") : (es ? "Crear cuenta" : "Create account")} →</button>
          </form>
          {error && <p role="alert" className="form-error">{error}</p>}
        </section>
      )}
    </main>
  );
}
