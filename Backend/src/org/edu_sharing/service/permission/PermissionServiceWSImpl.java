package org.edu_sharing.service.permission;

import java.rmi.RemoteException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.log4j.Logger;
import org.edu_sharing.repository.client.rpc.ACE;
import org.edu_sharing.repository.client.rpc.ACL;
import org.edu_sharing.repository.client.rpc.Authority;
import org.edu_sharing.repository.client.rpc.Group;
import org.edu_sharing.repository.client.rpc.Notify;
import org.edu_sharing.repository.client.rpc.Result;
import org.edu_sharing.repository.client.rpc.User;
import org.edu_sharing.repository.client.tools.CCConstants;
import org.edu_sharing.repository.server.tools.ApplicationInfo;
import org.edu_sharing.repository.server.tools.ApplicationInfoList;
import org.edu_sharing.webservices.alfresco.extension.KeyValue;
import org.edu_sharing.webservices.alfresco.extension.NativeAlfrescoWrapper;
import org.edu_sharing.webservices.alfresco.extension.RepositoryNode;
import org.edu_sharing.webservices.util.EduWebServiceFactory;

public class PermissionServiceWSImpl implements PermissionService {

	ApplicationInfo appInfo;

	Logger logger = Logger.getLogger(PermissionServiceWSImpl.class);

	public PermissionServiceWSImpl(String appid) {
		appInfo = ApplicationInfoList.getRepositoryInfoById(appid);
	}

	@Override
	public void addPermissions(String _nodeId, HashMap<String, String[]> _authPerm, Boolean _inheritPermissions,
			String _mailText, Boolean _sendMail, Boolean _sendCopy, Boolean createHandle) throws Throwable {
	}

	@Override
	public List<Notify> getNotifyList(String nodeId) throws Throwable {
		return null;
	}

	@Override
	public void setPermissions(String nodeId, ACE[] aces, Boolean inheritPermissions, String mailText, Boolean sendMail,
			Boolean sendCopy, Boolean createHandle) throws Throwable {
	}

	@Override
	public void addPermissions(String nodeId, ACE[] aces) throws Exception {
	}

	@Override
	public void createNotifyObject(String nodeId, String user, String event, String action) {
	}

	@Override
	public boolean hasPermission(String storeProtocol, String storeId, String nodeId, String permission) {
		return hasAllPermissions(storeProtocol,storeId,nodeId,new String[]{permission}).get(permission);
	}

	@Override
	public Result<List<Authority>> findAuthorities(String searchWord, boolean globalContext, int from,
			int nrOfResults) {
		return null;
	}

	@Override
	public org.edu_sharing.repository.client.rpc.Result<List<Group>> findGroups(String searchWord,
			boolean globalContext, int from, int nrOfResults) {
		try {
			NativeAlfrescoWrapper naw = EduWebServiceFactory.getNativeAlfrescoWrapper(appInfo.getWebServiceHotUrl());
			org.edu_sharing.webservices.alfresco.extension.SearchResult wsResult = naw.findGroups(searchWord, null,
					from, nrOfResults);
			org.edu_sharing.repository.client.rpc.Result<List<Group>> result = new org.edu_sharing.repository.client.rpc.Result<List<Group>>();
			result.setNodeCount(wsResult.getNodeCount());
			result.setStartIDX(wsResult.getStartIDX());

			List<Group> data = new ArrayList<Group>();
			result.setData(data);
			for (RepositoryNode repoNode : wsResult.getData()) {
				Group g = new Group();
				for (KeyValue wsProp : repoNode.getProperties()) {
					if (wsProp.getKey().equals(CCConstants.CM_PROP_AUTHORITY_AUTHORITYDISPLAYNAME)) {
						g.setDisplayName(wsProp.getValue());
					}
					if (wsProp.getKey().equals(CCConstants.CM_PROP_AUTHORITY_AUTHORITYNAME)) {
						g.setName(wsProp.getValue());
					}
					if (wsProp.getKey().equals(CCConstants.SYS_PROP_NODE_UID)) {
						g.setNodeId(wsProp.getValue());
					}
					if (wsProp.getKey().equals(CCConstants.REPOSITORY_ID)) {
						g.setRepositoryId(wsProp.getValue());
					}
					if (wsProp.getKey().equals(CCConstants.PERM_AUTHORITYTYPE_KEY)) {
						g.setAuthorityType(wsProp.getValue());
					}
					data.add(g);

				}
			}

			return result;

		} catch (RemoteException e) {
			logger.error(e.getMessage(), e);
			return null;
		}
	}

	@Override
	public org.edu_sharing.repository.client.rpc.Result<List<User>> findUsers(HashMap<String, String> propVals,
			boolean globalContext, int from, int nrOfResults) {

		try {
			NativeAlfrescoWrapper naw = EduWebServiceFactory.getNativeAlfrescoWrapper(appInfo.getWebServiceHotUrl());

			List<KeyValue> wsParam = new ArrayList<KeyValue>();
			for (Map.Entry<String, String> entry : propVals.entrySet()) {
				wsParam.add(new KeyValue(entry.getKey(), entry.getValue()));
			}
			org.edu_sharing.webservices.alfresco.extension.SearchResult wsResult = naw
					.findUsers(wsParam.toArray(new KeyValue[wsParam.size()]), null, from, nrOfResults);
			org.edu_sharing.repository.client.rpc.Result<List<User>> result = new org.edu_sharing.repository.client.rpc.Result<List<User>>();
			result.setNodeCount(wsResult.getNodeCount());
			result.setStartIDX(wsResult.getStartIDX());

			List<User> data = new ArrayList<User>();
			result.setData(data);
			for (RepositoryNode repoNode : wsResult.getData()) {
				User u = new User();
				for (KeyValue wsProp : repoNode.getProperties()) {
					if (wsProp.getKey().equals(CCConstants.CM_PROP_PERSON_EMAIL)) {
						u.setEmail(wsProp.getValue());
					}
					if (wsProp.getKey().equals(CCConstants.CM_PROP_PERSON_FIRSTNAME)) {
						u.setGivenName(wsProp.getValue());
					}
					if (wsProp.getKey().equals(CCConstants.SYS_PROP_NODE_UID)) {
						u.setNodeId(wsProp.getValue());
					}
					if (wsProp.getKey().equals(CCConstants.REPOSITORY_ID)) {
						u.setRepositoryId(wsProp.getValue());
					}
					if (wsProp.getKey().equals(CCConstants.CM_PROP_PERSON_LASTNAME)) {
						u.setSurname(wsProp.getValue());
					}
					if (wsProp.getKey().equals(CCConstants.CM_PROP_PERSON_USERNAME)) {
						u.setUsername(wsProp.getValue());
					}

					data.add(u);
				}
			}

			return result;
		} catch (RemoteException e) {
			logger.error(e.getMessage(), e);
			return null;
		}
	}

	@Override
	public void removePermissions(String nodeId, ACE[] aces) throws Exception {
	}

	@Override
	public void removePermissions(String nodeId, String authority, String[] _permissions) throws Exception {
	}

	@Override
	public void setPermissions(String nodeId, org.edu_sharing.repository.client.rpc.ACE[] aces) throws Exception {
		try {
			NativeAlfrescoWrapper naw = EduWebServiceFactory.getNativeAlfrescoWrapper(appInfo.getWebServiceHotUrl());
			naw.setPermissions(nodeId, aces);
		} catch (RemoteException e) {
			logger.error(e.getMessage(), e);
		}
	}

	@Override
	public void setPermissions(String nodeId, ACE[] aces, Boolean inheritPermission) throws Exception {
	}

	@Override
	public void setPermissions(String nodeId, String authority, String[] permissions, Boolean inheritPermission)
			throws Exception {
	}

	@Override
	public HashMap<String, Boolean> hasAllPermissions(String storeProtocol, String storeId, String nodeId,
			String[] permissions) {
		try {
			NativeAlfrescoWrapper naw = EduWebServiceFactory.getNativeAlfrescoWrapper(appInfo.getWebServiceHotUrl());
			return naw.hasAllPermissionsExt(storeProtocol, storeId, nodeId, permissions);
		} catch (RemoteException e) {
			logger.error(e.getMessage(), e);
			return null;
		}
	}
	
	@Override
	public ACL getPermissions(String nodeId) throws Exception {
		try {
			NativeAlfrescoWrapper naw = EduWebServiceFactory.getNativeAlfrescoWrapper(appInfo.getWebServiceHotUrl());
			return naw.getPermissions(nodeId);
		} catch (RemoteException e) {
			logger.error(e.getMessage(), e);
			return null;
		}
	}

	@Override
	public List<String> getPermissionsForAuthority(String nodeId, String authorityId) throws Exception {
		return null;
	}
	
	@Override
	public void setPermission(String nodeId, String authority, String permission) {
		// TODO Auto-generated method stub
		
	}
}
