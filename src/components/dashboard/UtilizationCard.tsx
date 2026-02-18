'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Segment } from '@/lib/types';
import { convertBandwidthToMbps, formatBandwidthForDisplay } from '@/lib/utils';
import { cn } from '@/lib/utils';
import React from 'react';

interface UtilisationCardProps {
  segment: Segment;
  utilisation?: {
    segmentId: string;
    util1to2: number;
    util2to1: number;
  };
  node1Name: string;
  node2Name: string;
  layout?: 'stacked' | 'side-by-side';
}

const UtilisationBar = ({
  direction,
  usedBw,
  maxBw,
  softLimit,
}: {
  direction: string;
  usedBw: number;
  maxBw: number;
  softLimit?: number;
}) => {
  const percentage = maxBw > 0 ? (usedBw / maxBw) * 100 : 0;
  const softLimitPercentage = softLimit && maxBw > 0 ? (softLimit / maxBw) * 100 : 0;
  const remainingBw = Math.max(0, maxBw - usedBw);

  let progressColour = 'bg-primary';
  if (maxBw > 0 && usedBw >= maxBw) {
    progressColour = 'bg-destructive';
  } else if (softLimit && usedBw > softLimit) {
    progressColour = 'bg-orange-500';
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="font-medium text-sm">{direction}</span>
        <span className="text-sm text-muted-foreground">
          {formatBandwidthForDisplay(usedBw)} / {formatBandwidthForDisplay(maxBw)}
        </span>
      </div>
      <div className="relative">
        <Progress value={Math.min(percentage, 100)} className="h-4" indicatorClassName={progressColour} />
        {softLimitPercentage > 0 && (
          <div
            className="absolute top-0 h-4 border-r-2 border-accent"
            style={{ left: `${softLimitPercentage}%` }}
            title={`Soft Limit: ${softLimit} Mbps`}
          />
        )}
      </div>
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
            Remaining: {formatBandwidthForDisplay(remainingBw)}
        </p>
        <p className="text-right font-mono text-sm">{percentage.toFixed(2)}% Used</p>
      </div>
    </div>
  );
};

export default function UtilisationCard({
  segment,
  utilisation,
  node1Name,
  node2Name,
  layout = 'stacked'
}: UtilisationCardProps) {
  const maxBw1to2 = convertBandwidthToMbps(
    parseFloat(segment.maxBandwidth1to2Input) || 0,
    segment.maxBandwidth1to2Unit
  );
  const softBw1to2 = parseFloat(segment.softLimit1to2MbpsInput) || 0;

  const maxBw2to1 = convertBandwidthToMbps(
    parseFloat(segment.maxBandwidth2to1Input) || 0,
    segment.maxBandwidth2to1Unit
  );
  const softBw2to1 = parseFloat(segment.softLimit2to1MbpsInput) || 0;

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-lg">
          Segment: {node1Name} &harr; {node2Name}
        </CardTitle>
      </CardHeader>
      <CardContent className={cn(
        "grid gap-6",
        layout === 'side-by-side' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
      )}>
        <UtilisationBar
          direction={`${node1Name} -> ${node2Name}`}
          usedBw={utilisation?.util1to2 || 0}
          maxBw={maxBw1to2}
          softLimit={softBw1to2}
        />
        <UtilisationBar
          direction={`${node2Name} -> ${node1Name}`}
          usedBw={utilisation?.util2to1 || 0}
          maxBw={maxBw2to1}
          softLimit={softBw2to1}
        />
      </CardContent>
    </Card>
  );
}

// Custom indicator class for Progress component
declare module 'react' {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
      indicatorClassName?: string;
    }
}
