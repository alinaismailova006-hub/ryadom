
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Heart } from 'lucide-react';

export default function AccountForm({onSignedIn}: {onSignedIn: () => Promise<void>}) {
  const [register, setRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: register ? 'register' : 'login',
          login: fields.get('login'),
          password: fields.get('password'),
          name: fields.get('name'),
        }),
      });
      const result = await response.json() as {error?: string};
      if (!response.ok) throw new Error(result.error || 'Не удалось войти.');
      await onSignedIn();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось войти.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="account-screen">
      <section className="dialog account-dialog" aria-labelledby="account-title">
        <span className="account-heart"><Heart fill="currentColor" size={24}/></span>
        <h1 id="account-title">{register ? 'Создать аккаунт' : 'Войти в «Рядом»'}</h1>
        <p>Ваше место для двоих</p>
        <form key={String(register)} onSubmit={submit}>
          {register && <label>Твоё имя<input name="name" maxLength={40} required autoComplete="nickname"/></label>}
          <label>Логин<input name="login" minLength={3} maxLength={32} required autoComplete="username" autoCapitalize="none" spellCheck={false}/></label>
          <div className="password-field">
            <label htmlFor="account-password">Пароль</label>
            <div className="password-control">
              <input id="account-password" name="password" type={showPassword ? 'text' : 'password'}
                minLength={12} maxLength={128} required autoCapitalize="none" spellCheck={false}
                autoComplete={register ? 'new-password' : 'current-password'}/>
              <button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} aria-controls="account-password">
                {showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}
              </button>
            </div>
          </div>
          {register && <small>От 12 символов.</small>}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Подождите…' : register ? 'Зарегистрироваться' : 'Войти'}</button>
        </form>
        <button className="textbtn account-switch" disabled={busy} onClick={() => {setRegister(!register); setShowPassword(false); setError('');}}>
          {register ? 'Уже есть аккаунт? Войти' : 'Впервые здесь? Создать аккаунт'}
        </button>
      </section>
    </main>
  );
}
