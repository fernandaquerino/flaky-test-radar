'use client';
import { ErrorState } from '../components/shell';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main id="main">
      <ErrorState
        message="Something went wrong while displaying this page."
        retry={reset}
      />
    </main>
  );
}
