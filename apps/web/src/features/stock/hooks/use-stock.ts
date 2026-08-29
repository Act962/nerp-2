import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

interface UseStockProps {
  userIds: string[] | undefined;
  limit: number;
  offset: number;
  dateInit?: Date;
  dateEnd?: Date;
  productId?: string;
}

export const useStock = ({
  userIds,
  limit,
  offset,
  dateInit,
  dateEnd,
  productId,
}: UseStockProps) => {
  const { data: stock, isLoading } = useQuery(
    orpc.stocks.list.queryOptions({
      input: {
        userIds,
        limit,
        offset,
        dateInit,
        dateEnd,
        productId,
      },
    }),
  );
  return {
    data: stock?.moviments ?? [],
    isStockLoading: isLoading,
  };
};
