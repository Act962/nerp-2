import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseDashboardProps {
  dateInit?: Date;
  dateEnd?: Date;
}

export function useQueryDashboard({ dateInit, dateEnd }: UseDashboardProps) {
  const { data, isLoading } = useQuery(
    orpc.dashboard.list.queryOptions({
      input: {},
    })
  );

  return {
    data,
    isDashboardLoading: isLoading,
  };
}
