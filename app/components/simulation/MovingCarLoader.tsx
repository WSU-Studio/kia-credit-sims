'use client';

import { IconCarFilled } from '@tabler/icons-react';

type MovingCarLoaderProps = {
  className?: string;
};

function LineRow({
  count,
  barClassName,
  gapClassName,
  durationClassName,
}: {
  count: number;
  barClassName: string;
  gapClassName: string;
  durationClassName?: string;
}) {
  const bars = (offset: string) =>
    Array.from({ length: count }, (_, i) => (
      <span key={`${offset}-${i}`} className={`shrink-0 rounded-full ${barClassName}`} />
    ));

  return (
    <div
      className={`flex w-max ${gapClassName} animate-motion-lines motion-reduce:animate-none ${durationClassName ?? ''}`}
    >
      {bars('a')}
      {bars('b')}
    </div>
  );
}

export function MovingCarLoader({ className = '' }: MovingCarLoaderProps) {
  return (
    <div
      className={`relative h-20 w-56 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)] ${className}`}
      aria-hidden
    >
      <div className="absolute inset-x-0 top-5 flex justify-start">
        <LineRow
          count={8}
          gapClassName="gap-10"
          barClassName="h-px w-10 bg-[#002c5f]/25"
          durationClassName="[animation-duration:3.1s]"
        />
      </div>
      <div className="absolute inset-x-0 top-9 flex justify-start">
        <LineRow
          count={7}
          gapClassName="gap-12"
          barClassName="h-0.5 w-14 bg-[#002c5f]/35"
        />
      </div>
      <div className="absolute inset-x-0 bottom-3 flex justify-start">
        <LineRow
          count={10}
          gapClassName="gap-7"
          barClassName="h-1 w-8 bg-[#002c5f]/20"
          durationClassName="[animation-duration:1.7s]"
        />
      </div>
      <IconCarFilled className="absolute left-1/2 top-[42%] h-10 w-16 -translate-x-1/2 -translate-y-1/2 text-[#002c5f] motion-reduce:translate-y-[-50%]" />
    </div>
  );
}
