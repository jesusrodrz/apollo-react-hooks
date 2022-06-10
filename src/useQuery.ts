import {
  DocumentNode,
  OperationVariables,
  QueryHookOptions,
  TypedDocumentNode,
  useApolloClient,
  ApolloQueryResult,
  ApolloClient,
  QueryResult,
} from "@apollo/client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { deepEqual } from "./utils";

export function useSuspendedQuery<TData = any, TVariables = OperationVariables>(
  query: DocumentNode | TypedDocumentNode<TData, TVariables>,
  props?: QueryHookOptions<TData, TVariables> & {
    client?: ApolloClient<unknown>;
    suspendTimeout?: number;
  }
): Pick<
  QueryResult<TData>,
  | "data"
  | "refetch"
  | "called"
  | "fetchMore"
  | "startPolling"
  | "subscribeToMore"
  | "updateQuery"
  | "stopPolling"
  | "loading"
> {
  const client = useApolloClient(props?.client);

  const [observedQuery] = useState(() => {
    const obsQuery = client.watchQuery<TData, TVariables>({ query, ...props });
    return obsQuery;
  });

  const snapShotCache = useRef<ApolloQueryResult<TData>>(
    observedQuery.getCurrentResult()
  );

  const optionRef = useRef({ query, ...props });

  useEffect(() => {
    const newProps = { query, ...props };
    const arePropsEqual = deepEqual(optionRef.current, newProps);

    if (arePropsEqual) {
      return;
    }

    observedQuery.setOptions(newProps);

    optionRef.current = newProps;
  }, [client, query, props, observedQuery]);

  const subscribeStore = useCallback(
    (store: () => void) => {
      const unSub = observedQuery.subscribe((data) => {
        snapShotCache.current = data;
        store();
      });
      return () => {
        unSub.unsubscribe();
      };
    },
    [observedQuery]
  );

  const getSnapshot = useCallback(() => {
    return snapShotCache.current;
  }, []);

  const data = useSyncExternalStore(subscribeStore, getSnapshot);

  const cache = client.readQuery<TData, TVariables>({ query, ...props });

  if (!cache && !props?.skip) {
    const { fetchPolicy, ...newProps } = props ?? {};
    const promise = client.query({
      query,
      ...newProps,
    });

    throw promise;
  }
  return {
    ...data,
    called: true,
    refetch: observedQuery.refetch.bind(observedQuery),
    fetchMore: observedQuery.fetchMore.bind(observedQuery),
    updateQuery: observedQuery.updateQuery.bind(observedQuery),
    startPolling: observedQuery.startPolling.bind(observedQuery),
    stopPolling: observedQuery.stopPolling.bind(observedQuery),
    subscribeToMore: observedQuery.subscribeToMore.bind(observedQuery),
  };
}
