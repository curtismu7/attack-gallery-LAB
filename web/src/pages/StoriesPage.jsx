import { useState } from 'react';
import StoryPanel from '../story/StoryPanel.jsx';
import { STORIES } from '../story/stories.js';
import { attackHref } from '../components/bits.jsx';

export default function StoriesPage() {
  const [id, setId] = useState(STORIES[0].id);
  const story = STORIES.find((s) => s.id === id);
  return (
    <>
      <h1>Stories</h1>
      <p className="lede">A talk track for each story: what to say, step by step, in the words of a vertical. Switch between what the attack does and what the control does.</p>
      <div className="seg" role="group" aria-label="Story">
        {STORIES.map((s) => <button key={s.id} type="button" aria-pressed={s.id === id} onClick={() => setId(s.id)}>{s.title}</button>)}
      </div>
      <StoryPanel key={story.id} story={story} />
      <p>{story.modes.map((m) => <a key={m} className="link-button" href={attackHref(m)}>Run the attack for this story</a>)}</p>
    </>
  );
}
