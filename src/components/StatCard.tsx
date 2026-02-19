import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

const StatCard = ({ title, value, subtitle, icon, trend }: StatCardProps) => {
  return (
    <Card className="p-3 sm:p-6 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
          <h3 className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold text-foreground break-words leading-tight">{value}</h3>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground break-words leading-snug">{subtitle}</p>}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={`text-xs font-medium ${
                  trend.isPositive ? "text-success" : "text-destructive"
                }`}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}
              </span>
              <span className="text-xs text-muted-foreground">vs. last month</span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
    </Card>
  );
};

export default StatCard;
