'use client';
import { ErrorBody } from '@/app/global-error';
export default function Error({ error, reset }) { return <ErrorBody error={error} reset={reset} />; }
