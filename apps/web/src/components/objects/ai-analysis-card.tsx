'use client'

import { Zap, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils/format'
import type { AIAnalysis } from '@/types'

const COMPLEXITY_LABELS = {
  low: 'Низька',
  medium: 'Середня',
  high: 'Висока',
  very_high: 'Дуже висока',
}

const COMPLEXITY_COLORS = {
  low: 'success',
  medium: 'warning',
  high: 'destructive',
  very_high: 'destructive',
} as const

interface AIAnalysisCardProps {
  analysis: AIAnalysis
}

export function AIAnalysisCard({ analysis }: AIAnalysisCardProps) {
  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-zinc-200">AI Аналіз</h3>
          <Badge variant="purple" className="text-xs">
            {Math.round(analysis.score * 100)}% потенціал
          </Badge>
        </div>
        <span className="text-xs text-zinc-600">{analysis.model_version}</span>
      </div>

      {/* Summary */}
      <p className="text-sm text-zinc-300 leading-relaxed">{analysis.summary}</p>

      {/* Opportunity scores */}
      <div className="space-y-3">
        {analysis.hvac_opportunity !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">HVAC можливість</span>
              <span className="text-purple-400 font-medium">
                {Math.round(analysis.hvac_opportunity * 100)}%
              </span>
            </div>
            <Progress value={analysis.hvac_opportunity * 100} className="h-1.5" />
          </div>
        )}
        {analysis.itp_opportunity !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">ІТП можливість</span>
              <span className="text-purple-400 font-medium">
                {Math.round(analysis.itp_opportunity * 100)}%
              </span>
            </div>
            <Progress value={analysis.itp_opportunity * 100} className="h-1.5" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {analysis.engineering_complexity && (
          <div className="rounded-lg bg-zinc-900/50 p-2.5">
            <p className="text-zinc-500 mb-1">Інж. складність</p>
            <Badge variant={COMPLEXITY_COLORS[analysis.engineering_complexity]}>
              {COMPLEXITY_LABELS[analysis.engineering_complexity]}
            </Badge>
          </div>
        )}
        {analysis.estimated_budget_uah && (
          <div className="rounded-lg bg-zinc-900/50 p-2.5">
            <p className="text-zinc-500 mb-1">Орієнт. бюджет</p>
            <p className="font-medium text-zinc-200">{formatCurrency(analysis.estimated_budget_uah)}</p>
          </div>
        )}
      </div>

      {/* Insights */}
      {analysis.opportunity_insights && analysis.opportunity_insights.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Інсайти</p>
          {analysis.opportunity_insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
              <TrendingUp className="h-3 w-3 text-purple-400 mt-0.5 shrink-0" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommended actions */}
      {analysis.recommended_actions && analysis.recommended_actions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Рекомендовані дії</p>
          {analysis.recommended_actions.map((action, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
              <CheckCircle className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
              <span>{action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
