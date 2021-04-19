import {
  useEffect,
  useParameter,
  useRef,
  useChannel,
  addons
} from "@storybook/addons";
import { Response } from "miragejs";
import { FORCE_RE_RENDER } from "@storybook/core-events";
import { PARAM_KEY, EVENTS, ADDON_ID } from "./constants";

let server = null;
let clients = [];

const emit = useChannel({
    [EVENTS.SET]: ({ verb, path, response }) => {
        server[verb.toLowerCase()](path, () => {
            if (typeof response === "number") return new Response(response);
            if (Array.isArray(response)) return new Response(...response);
            return new Response(200, {}, response);
        });
        addons.getChannel().emit(FORCE_RE_RENDER);
    }
});


function setupServer(server){
    const {
        handledRequest,
        unhandledRequest,
        erroredRequest
    } = server.current.pretender;
    server.pretender.handledRequest = function (verb, path, request) {
        handledRequest(verb, path, request);
        emit(EVENTS.REQUEST, { verb, path, request });
    };

    server.pretender.unhandledRequest = function (verb, path, request) {
        unhandledRequest(verb, path, request);
        emit(EVENTS.UNHANDLED, { verb, path, request });
    };

    server.pretender.erroredRequest = function (
        verb,
        path,
        request,
        error
    ) {
        erroredRequest(verb, path, request, error);
        emit(EVENTS.ERROR, { verb, path, request, error });
    };
}

function configureServer({server, logging, fixtures, handlers, timing}){
    server.current.logging = logging;

    if (fixtures) server.current.db.loadData(fixtures);
    if (timing !== null) server.current.timing = timing;
    if (handlers) {
        Object.keys(handlers).forEach(method => {
            const set = handlers[method];
            Object.keys(set).forEach(route => {
                const value = set[route];
                server.current[method](route, () => {
                    if (typeof value === "number") return new Response(value);
                    if (Array.isArray(value)) return new Response(...value);
                    return new Response(200, {}, value);
                });
            });
        });
    }
}

export const withServer = makeServer => (StoryFn, context) => {
  const client = useRef();
  const { logging, fixtures, handlers, timing, instance } = useParameter(
    PARAM_KEY,
    {
      handlers: null,
      fixtures: null,
      logging: false,
      timing: null,
      instance: null
    }
  );
  useEffect(() => {
    clients.push(client);
      if(server == null){
    if (instance) {
      server = instance;
    }
    if (makeServer) {
      server = makeServer();
    }
          if (!server) return;

      }



      configureServer(server)

      return () => {
          clients = clients.filter(item => item !== client);
          if(clients.length == 0){
              server.shutdown();
              server = null;
          };
      };
  }, []);

  return StoryFn();
};
