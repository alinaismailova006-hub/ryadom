
import { useState } from 'react';
import { CalendarDays, Camera, Heart, Plus, Trash2 } from 'lucide-react';
import { calendarToday, daysBetween, daysLabel, formatDate, type Milestone } from './relationship';

type Pair = { startDate?: string | null; photoVersion?: string | null };
type Props = {pair: Pair; events: Milestone[]; today: string; save: (payload: object) => Promise<boolean>; busy: boolean};

function remaining(date: string, today: string) {
  const days = daysBetween(today, date);
  if (days === 0) return 'Сегодня';
  return days > 0 ? `Через ${daysLabel(days)}` : `${daysLabel(days)} назад`;
}

async function preparePhoto(file: File) {
  if (file.size > 15_000_000) throw new Error('Выбери фото размером до 15 МБ.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error('Не удалось открыть фото. Выбери JPEG, PNG или WebP.'); });
    const ratio = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Не удалось обработать фото.');
    context.fillStyle = '#fffdfa';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [.86, .72, .58, .44, .3]) {
      const data = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      if (data && data.length <= 420_000) return data;
    }
    throw new Error('Снимок слишком большой. Выбери другое фото.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function RelationshipPanel({pair, events, today, save, busy}: Props) {
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const disabled = busy || uploading;
  const future = events.filter(event => event.date >= today);
  const past = events.filter(event => event.date < today).reverse();

  async function upload(file?: File) {
    if (!file) return;
    setPhotoError('');
    setUploading(true);
    try {
      await save({action: 'photo', photo: await preparePhoto(file)});
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Не удалось открыть фото.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relationship-grid">
      <section className="memory-card">
        {pair.photoVersion ? <img className="couple-photo" src={'/api/couple/photo?v=' + pair.photoVersion} alt="Общее фото пары"/> :
          <div className="photo-placeholder"><Heart size={34}/></div>}
        <div className="photo-controls">
          <label className={'secondary photo-button' + (disabled ? ' is-disabled' : '')}>
            <Camera size={17}/>{uploading ? 'Загружаем…' : pair.photoVersion ? 'Заменить фото' : 'Добавить фото'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={disabled} onChange={event => {void upload(event.target.files?.[0]); event.target.value = '';}}/>
          </label>
          {pair.photoVersion && <button className="textbtn" disabled={disabled} onClick={() => save({action:'photo',photo:null})}>Убрать фото</button>}
        </div>
        {photoError && <p className="error" role="alert">{photoError}</p>}
        <h2>{pair.startDate ? `${daysLabel(Math.max(0, daysBetween(pair.startDate, today)))} вместе` : 'Сколько мы вместе'}</h2>
        {pair.startDate && <p>С {formatDate(pair.startDate)}</p>}
        <form onSubmit={event => {
          event.preventDefault();
          const fields = new FormData(event.currentTarget);
          void save({action:'startDate',date:fields.get('date')});
        }}>
          <label>Дата начала отношений<input key={pair.startDate} name="date" type="date" required min="1900-01-01" max={calendarToday()} defaultValue={pair.startDate || ''}/></label>
          <button className="primary" disabled={disabled}>Сохранить дату</button>
        </form>
      </section>
      <section className="memory-card">
        <h2>Памятные даты</h2>
        <form onSubmit={async event => {
          event.preventDefault();
          const form = event.currentTarget;
          const fields = new FormData(form);
          if (await save({action:'addEvent',title:fields.get('title'),date:fields.get('date')})) form.reset();
        }}>
          <label>Название<input name="title" required maxLength={80} placeholder="Например, следующая встреча"/></label>
          <label>Дата события<input name="date" type="date" required min="1900-01-01"/></label>
          <button className="primary" disabled={disabled}><Plus size={17}/>Добавить дату</button>
        </form>
        {events.length === 0 && <p className="memory-empty">Добавь встречу, годовщину или день, который хочется запомнить.</p>}
        {[...future, ...past].map(event => (
          <article className="memory-event" key={event.id}>
            <CalendarDays size={19}/>
            <div><h3>{event.title}</h3><p>{formatDate(event.date)} · {remaining(event.date,today)}</p></div>
            <button className="iconbtn" aria-label={`Удалить дату «${event.title}»`} title="Удалить дату"
              disabled={disabled} onClick={() => save({action:'removeEvent',id:event.id})}><Trash2 size={16}/></button>
          </article>
        ))}
      </section>
    </div>
  );
}
